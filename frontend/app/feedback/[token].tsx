import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

export default function FeedbackPage() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { token } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackRequest, setFeedbackRequest] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [publishToGoogle, setPublishToGoogle] = useState(true);
  const [allowUseName, setAllowUseName] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [googleLink, setGoogleLink] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadFeedbackRequest();
    }
  }, [token]);

  const loadFeedbackRequest = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/feedback/${token}`);
      setFeedbackRequest(response.data);
    } catch (error: any) {
      Alert.alert(t('common.error'), t('feedback.submitError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(t('common.error'), t('feedback.submitErrorRating'));
      return;
    }

    try {
      setSubmitting(true);

      const response = await api.post(`/feedback/${token}/submit`, {
        rating,
        comment: comment.trim() || null,
        publish_to_google: publishToGoogle,
        allow_use_name: allowUseName,
      });

      if (response.data.success) {
        setSubmitted(true);
        setGoogleLink(response.data.google_link);
        
        if (publishToGoogle && response.data.google_link) {
          Alert.alert(
            t('feedback.submitSuccessTitle'),
            t('feedback.submitSuccessGoogle'),
            [
              { text: t('feedback.notNow'), style: 'cancel' },
              {
                text: t('feedback.goToGoogle'),
                onPress: () => {
                  if (Platform.OS === 'web') {
                    window.open(response.data.google_link, '_blank');
                  } else {
                    Linking.openURL(response.data.google_link);
                  }
                },
              },
            ]
          );
        } else {
          Alert.alert('🎉', t('feedback.submitSuccessSimple'));
        }
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('feedback.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={48}
              color={star <= rating ? '#FFD700' : '#ddd'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>{t('feedback.loading')}</Text>
      </View>
    );
  }

  if (!feedbackRequest) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="close-circle" size={64} color="#ff6b6b" />
        <Text style={styles.errorTitle}>{t('feedback.errorTitle')}</Text>
        <Text style={styles.errorText}>{t('feedback.errorText')}</Text>
      </View>
    );
  }

  if (feedbackRequest.already_completed) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={64} color="#51cf66" />
        <Text style={styles.successTitle}>{t('feedback.alreadyCompletedTitle')}</Text>
        <Text style={styles.successText}>{t('feedback.alreadyCompletedText')}</Text>
        <Text style={styles.successText}>{t('feedback.alreadyCompletedThanks')}</Text>
      </View>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <Ionicons name="heart" size={80} color="#4ECDC4" />
          <Text style={styles.successTitle}>{t('feedback.thankYouTitle', { name: feedbackRequest.user_name })}</Text>
          <Text style={styles.successText}>{t('feedback.thankYouText')}</Text>
          
          {googleLink && publishToGoogle && (
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.open(googleLink, '_blank');
                } else {
                  Linking.openURL(googleLink);
                }
              }}
            >
              <Ionicons name="logo-google" size={24} color="white" />
              <Text style={styles.googleButtonText}>{t('feedback.publishOnGoogle')}</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.thankYouNote}>{t('feedback.thankYouNote')}</Text>
        </View>
      </SafeAreaView>
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
          <Ionicons name="heart" size={48} color="white" />
          <Text style={styles.headerTitle}>{t('feedback.headerTitle')}</Text>
          <Text style={styles.headerSubtitle}>Ross Tax Preparation</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.greeting}>{t('feedback.greeting', { name: feedbackRequest.user_name })}</Text>
            <Text style={styles.infoText}>
              {t('feedback.thankForTrusting', { type: feedbackRequest.appointment_type })}
            </Text>
            <View style={styles.appointmentInfo}>
              <Ionicons name="calendar" size={16} color={colors.primary} />
              <Text style={styles.appointmentText}>
                {t('feedback.dateLabel', { date: feedbackRequest.appointment_date })}
              </Text>
            </View>
          </View>

          {/* Rating Section */}
          <View style={styles.ratingCard}>
            <Text style={styles.cardTitle}>{t('feedback.rateTitle')}</Text>
            <Text style={styles.cardSubtitle}>{t('feedback.rateSubtitle')}</Text>
            {renderStars()}
            {rating > 0 && (
              <Text style={styles.ratingText}>
                {rating === 5 && t('feedback.rating5')}
                {rating === 4 && t('feedback.rating4')}
                {rating === 3 && t('feedback.rating3')}
                {rating === 2 && t('feedback.rating2')}
                {rating === 1 && t('feedback.rating1')}
              </Text>
            )}
          </View>

          {/* Comment Section */}
          <View style={styles.commentCard}>
            <Text style={styles.cardTitle}>{t('feedback.commentTitle')}</Text>
            <Text style={styles.cardSubtitle}>{t('feedback.commentSubtitle')}</Text>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder={t('feedback.commentPlaceholder')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Options */}
          <View style={styles.optionsCard}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setPublishToGoogle(!publishToGoogle)}
            >
              <Ionicons
                name={publishToGoogle ? 'checkbox' : 'square-outline'}
                size={24}
                color={colors.primary}
              />
              <View style={styles.checkboxText}>
                <Text style={styles.checkboxLabel}>{t('feedback.publishGoogleLabel')}</Text>
                <Text style={styles.checkboxSubtext}>{t('feedback.publishGoogleSubtext')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAllowUseName(!allowUseName)}
            >
              <Ionicons
                name={allowUseName ? 'checkbox' : 'square-outline'}
                size={24}
                color={colors.primary}
              />
              <View style={styles.checkboxText}>
                <Text style={styles.checkboxLabel}>{t('feedback.allowNameLabel')}</Text>
                <Text style={styles.checkboxSubtext}>{t('feedback.allowNameSubtext')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, (rating === 0 || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={rating === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>{t('feedback.submitButton')}</Text>
                <Ionicons name="send" size={20} color="white" />
              </>
            )}
          </TouchableOpacity>
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
      fontSize: 28,
      fontWeight: '800',
      color: '#333',
      marginTop: 20,
      marginBottom: 16,
      textAlign: 'center',
    },
    successText: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 12,
    },
    thankYouNote: {
      fontSize: 14,
      color: '#999',
      textAlign: 'center',
      marginTop: 20,
      fontStyle: 'italic',
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#4285F4',
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 8,
      marginTop: 24,
      gap: 10,
    },
    googleButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '700',
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
    infoCard: {
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
    greeting: {
      fontSize: 20,
      fontWeight: '700',
      color: '#333',
      marginBottom: 8,
    },
    infoText: {
      fontSize: 15,
      color: '#666',
      lineHeight: 22,
      marginBottom: 12,
    },
    appointmentInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    appointmentText: {
      fontSize: 14,
      color: '#666',
    },
    ratingCard: {
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 24,
      marginBottom: 20,
      alignItems: 'center',
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
      fontSize: 18,
      fontWeight: '700',
      color: '#333',
      marginBottom: 8,
      textAlign: 'center',
    },
    cardSubtitle: {
      fontSize: 14,
      color: '#666',
      marginBottom: 20,
      textAlign: 'center',
    },
    starsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginVertical: 10,
    },
    starButton: {
      padding: 4,
    },
    ratingText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#4ECDC4',
      marginTop: 12,
    },
    commentCard: {
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
    commentInput: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      minHeight: 120,
      backgroundColor: '#f9f9f9',
    },
    optionsCard: {
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      gap: 16,
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
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    checkboxText: {
      flex: 1,
    },
    checkboxLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: '#333',
      marginBottom: 4,
    },
    checkboxSubtext: {
      fontSize: 13,
      color: '#666',
    },
    submitButton: {
      flexDirection: 'row',
      backgroundColor: '#4ECDC4',
      padding: 18,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 20,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '700',
    },
  });
