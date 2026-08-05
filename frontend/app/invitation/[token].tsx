import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

export default function InvitationPage() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { token } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    address: '',
    ssn_itin: '',
    birthdate: '',
  });

  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/invitation/${token}`);
      setInvitation(response.data);
      
      setFormData({
        phone: response.data.attendee_phone || '',
        email: response.data.attendee_email || '',
        address: '',
        ssn_itin: '',
        birthdate: '',
      });
    } catch (error: any) {
      Alert.alert(t('common.error'), t('invitation.errorLoadInvitation'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.email) {
      Alert.alert(t('common.error'), t('invitation.errorEmailRequired'));
      return;
    }

    if (!formData.phone && !formData.email) {
      Alert.alert(t('common.error'), t('invitation.errorContactRequired'));
      return;
    }

    try {
      setSubmitting(true);

      const response = await api.post(`/invitation/${token}/complete`, formData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        Alert.alert(
          t('invitation.successTitle'),
          response.data.credentials_sent
            ? t('invitation.successWithCredentials')
            : t('invitation.successSimple'),
          [
            {
              text: t('invitation.understood'),
              onPress: () => {
                if (Platform.OS === 'web') {
                  window.location.href = 'https://rosstaxpreparation.com';
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('invitation.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>{t('invitation.loading')}</Text>
      </View>
    );
  }

  if (!invitation) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="close-circle" size={64} color="#ff6b6b" />
        <Text style={styles.errorTitle}>{t('invitation.errorNotFound')}</Text>
        <Text style={styles.errorText}>{t('invitation.errorNotFoundText')}</Text>
      </View>
    );
  }

  if (invitation.is_expired) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="time-outline" size={64} color="#ff6b6b" />
        <Text style={styles.errorTitle}>{t('invitation.errorExpired')}</Text>
        <Text style={styles.errorText}>
          {t('invitation.errorExpiredText', { date: new Date(invitation.expires_at).toLocaleDateString() })}
        </Text>
      </View>
    );
  }

  if (invitation.already_completed) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={64} color="#51cf66" />
        <Text style={styles.successTitle}>{t('invitation.alreadyCompletedTitle')}</Text>
        <Text style={styles.successText}>{t('invitation.alreadyCompletedText')}</Text>
        <Text style={styles.successText}>{t('invitation.alreadyCompletedEmail')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#4ECDC4', '#44A08D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Ionicons name="calendar" size={48} color="white" />
          <Text style={styles.headerTitle}>Ross Tax Preparation</Text>
          <Text style={styles.headerSubtitle}>{t('invitation.headerSubtitle')}</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Invitation Info */}
          <View style={styles.invitationCard}>
            <Text style={styles.cardTitle}>{t('invitation.yourAppointment')}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={20} color={colors.primary} />
              <Text style={styles.infoLabel}>{t('invitation.invitedBy')}</Text>
              <Text style={styles.infoValue}>{invitation.invited_by}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.infoLabel}>{t('invitation.date')}</Text>
              <Text style={styles.infoValue}>{invitation.appointment_date}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color={colors.primary} />
              <Text style={styles.infoLabel}>{t('invitation.time')}</Text>
              <Text style={styles.infoValue}>{invitation.appointment_time}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons
                name={invitation.appointment_type === 'video_call' ? 'videocam' : 'business'}
                size={20}
                color={colors.primary}
              />
              <Text style={styles.infoLabel}>{t('invitation.type')}</Text>
              <Text style={styles.infoValue}>
                {invitation.appointment_type === 'video_call' ? t('invitation.videoCall') : t('invitation.inPerson')}
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>{t('invitation.yourInfo')}</Text>
            <Text style={styles.cardSubtitle}>{t('invitation.completeInfo')}</Text>

            <Text style={styles.label}>{t('invitation.name')}</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={invitation.attendee_name}
              editable={false}
            />

            <Text style={styles.label}>
              {t('invitation.phone')} {formData.email ? t('invitation.phoneOptional') : '*'}
            </Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(value) => setFormData({ ...formData, phone: value })}
              placeholder="+1 305-xxx-xxxx"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>{t('invitation.email')}</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(value) => setFormData({ ...formData, email: value })}
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('invitation.address')}</Text>
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(value) => setFormData({ ...formData, address: value })}
              placeholder="305 Bruce Ave, Dumas, TX"
            />

            <Text style={styles.label}>{t('invitation.ssnItin')}</Text>
            <TextInput
              style={styles.input}
              value={formData.ssn_itin}
              onChangeText={(value) => setFormData({ ...formData, ssn_itin: value })}
              placeholder="XXX-XX-XXXX"
              secureTextEntry
            />

            <Text style={styles.label}>{t('invitation.birthdate')}</Text>
            <TextInput
              style={styles.input}
              value={formData.birthdate}
              onChangeText={(value) => setFormData({ ...formData, birthdate: value })}
              placeholder="MM/DD/YYYY"
            />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={styles.infoBoxText}>{t('invitation.infoBoxText')}</Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>{t('invitation.submitButton')}</Text>
                  <Ionicons name="arrow-forward" size={20} color="white" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
      flexGrow: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: '#666',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      backgroundColor: '#f5f5f5',
    },
    errorTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: '#333',
      marginTop: 16,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
      lineHeight: 24,
    },
    successContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      backgroundColor: '#f5f5f5',
    },
    successTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: '#333',
      marginTop: 16,
      marginBottom: 8,
    },
    successText: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
      lineHeight: 24,
      marginTop: 8,
    },
    header: {
      padding: 40,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: 'white',
      marginTop: 16,
    },
    headerSubtitle: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.9)',
      marginTop: 8,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    invitationCard: {
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    formCard: {
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#333',
      marginBottom: 16,
    },
    cardSubtitle: {
      fontSize: 14,
      color: '#666',
      marginBottom: 20,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 8,
    },
    infoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#666',
    },
    infoValue: {
      fontSize: 14,
      color: '#333',
      fontWeight: '500',
      flex: 1,
      textAlign: 'right',
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: '#fff',
    },
    inputDisabled: {
      backgroundColor: '#f5f5f5',
      color: '#999',
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: '#e3f2fd',
      padding: 16,
      borderRadius: 8,
      marginTop: 20,
      borderLeftWidth: 4,
      borderLeftColor: '#4ECDC4',
    },
    infoBoxText: {
      flex: 1,
      fontSize: 13,
      color: '#333',
      lineHeight: 20,
    },
    submitButton: {
      flexDirection: 'row',
      backgroundColor: '#4ECDC4',
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
      gap: 8,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '700',
    },
  });
