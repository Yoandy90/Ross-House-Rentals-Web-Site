import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import CustomHeader from '../../components/CustomHeader';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

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
}

export default function MyAppointmentsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments/my');
      
      // Sort by date (most recent first)
      const sorted = (response.data || []).sort((a: Appointment, b: Appointment) => {
        return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
      });
      
      setAppointments(sorted);
    } catch (error: any) {
      console.error('Error loading appointments:', error);
      Alert.alert(
        t('myAppointments.loadError', 'Error al cargar citas'),
        error.response?.data?.detail || t('myAppointments.loadErrorMsg', 'No se pudieron cargar tus citas. Por favor intenta de nuevo.'),
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const joinVideoCall = async (appointment: Appointment) => {
    if (!appointment.meeting_link) {
      Alert.alert(t('common.error', 'Error'), t('myAppointments.noMeetingLink', 'No hay enlace de videollamada disponible'));
      return;
    }

    try {
      const supported = await Linking.canOpenURL(appointment.meeting_link);
      if (supported) {
        await Linking.openURL(appointment.meeting_link);
      } else {
        Alert.alert(t('common.error', 'Error'), t('myAppointments.cantOpenLink', 'No se puede abrir el enlace de videollamada'));
      }
    } catch (error) {
      Alert.alert(t('common.error', 'Error'), t('myAppointments.videoCallError', 'No se pudo abrir la videollamada'));
    }
  };

  const cancelAppointment = async (appointmentId: string) => {
    Alert.alert(
      t('myAppointments.cancelAppointment'),
      t('myAppointments.confirmCancel', '¿Estás seguro de que deseas cancelar esta cita?'),
      [
        {
          text: t('common.no', 'No'),
          style: 'cancel',
        },
        {
          text: t('myAppointments.yesCancel', 'Sí, Cancelar'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/appointments/${appointmentId}`);
              Alert.alert(t('common.success', 'Éxito'), t('myAppointments.cancelSuccess', 'Cita cancelada exitosamente'));
              loadAppointments();
            } catch (error) {
              Alert.alert(t('common.error', 'Error'), t('myAppointments.cancelFailed', 'No se pudo cancelar la cita'));
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'scheduled':
        return { label: 'Programada', color: '#4CAF50' };
      case 'completed':
        return { label: t('common.completed', 'Completada'), color: '#2196F3' };
      case 'cancelled':
        return { label: 'Cancelada', color: '#F44336' };
      default:
        return { label: status, color: '#666' };
    }
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  const canJoinNow = (dateString: string) => {
    const appointmentTime = new Date(dateString);
    const now = new Date();
    const diff = appointmentTime.getTime() - now.getTime();
    const minutesDiff = diff / (1000 * 60);
    
    // Can join 15 minutes before
    return minutesDiff <= 15 && minutesDiff >= -60;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <CustomHeader
          title={t('myAppointments.title')}
          showBackButton={true}
          onBackPress={() => router.back()}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader
        title="Mis Citas"
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {appointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={80} color={colors.border} />
            <Text style={styles.emptyTitle}>No tienes citas</Text>
            <Text style={styles.emptyText}>
              Agenda tu primera cita para ver tus próximas reuniones aquí
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/book-appointment')}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.textWhite} />
              <Text style={styles.createButtonText}>Agendar Cita</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {appointments.map((appointment) => {
              const statusInfo = getStatusInfo(appointment.status);
              const upcoming = isUpcoming(appointment.scheduled_at);
              const canJoin = canJoinNow(appointment.scheduled_at);

              return (
                <View key={appointment.id} style={styles.appointmentCard}>
                  <View style={styles.appointmentHeader}>
                    <View style={styles.typeIconContainer}>
                      <Ionicons
                        name={appointment.appointment_type === 'video_call' ? 'videocam' : 'business'}
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.appointmentInfo}>
                      <Text style={styles.appointmentTitle}>{appointment.title}</Text>
                      <View style={styles.typeTag}>
                        <Text style={styles.typeTagText}>
                          {appointment.appointment_type === 'video_call' ? 'Videollamada' : 'Presencial'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                      <Text style={styles.statusBadgeText}>{statusInfo.label}</Text>
                    </View>
                  </View>

                  <View style={styles.appointmentDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar" size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>{formatDate(appointment.scheduled_at)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time" size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>
                        {formatTime(appointment.scheduled_at)} ({appointment.duration_minutes} min)
                      </Text>
                    </View>
                    {appointment.description && (
                      <View style={styles.detailRow}>
                        <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
                        <Text style={styles.detailText}>{appointment.description}</Text>
                      </View>
                    )}
                  </View>

                  {/* Video Call Actions */}
                  {appointment.appointment_type === 'video_call' &&
                    appointment.status === 'scheduled' &&
                    upcoming && (
                      <View style={styles.videoCallActions}>
                        {canJoin ? (
                          <TouchableOpacity
                            style={styles.joinButton}
                            onPress={() => joinVideoCall(appointment)}
                          >
                            <Ionicons name="videocam" size={20} color={colors.textWhite} />
                            <Text style={styles.joinButtonText}>Unirse Ahora</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.waitingBadge}>
                            <Ionicons name="time-outline" size={16} color={colors.primary} />
                            <Text style={styles.waitingText}>
                              Podrás unirte 15 min antes
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                  {/* Cancel Button */}
                  {appointment.status === 'scheduled' && upcoming && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => cancelAppointment(appointment.id)}
                    >
                      <Text style={styles.cancelButtonText}>{t('myAppointments.cancelAppointment')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.newAppointmentButton}
              onPress={() => router.push('/book-appointment')}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.newAppointmentButtonText}>Agendar Nueva Cita</Text>
            </TouchableOpacity>
          </>
        )}
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
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: 24,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 32,
      lineHeight: 20,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    createButtonText: {
      color: colors.textWhite,
      fontSize: 16,
      fontWeight: '700',
    },
    appointmentCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    appointmentHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      backgroundColor: colors.background,
    },
    typeIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    appointmentInfo: {
      flex: 1,
    },
    appointmentTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    typeTag: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    typeTagText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textWhite,
    },
    appointmentDetails: {
      padding: 16,
      gap: 10,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    videoCallActions: {
      padding: 16,
      paddingTop: 8,
    },
    joinButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
    },
    joinButtonText: {
      color: colors.textWhite,
      fontSize: 16,
      fontWeight: '700',
    },
    waitingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary + '15',
      padding: 12,
      borderRadius: 12,
    },
    waitingText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    cancelButton: {
      padding: 16,
      paddingTop: 8,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    newAppointmentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      marginTop: 8,
    },
    newAppointmentButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
  });
