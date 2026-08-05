/**
 * Mi Reembolso - Success Screen
 * Shown after completing payment
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

export default function SuccessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.2, { damping: 10 }),
      withSpring(1, { damping: 15 })
    );
    opacity.value = withDelay(300, withSpring(1));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleShare = async () => {
    try {
      await Share.share({
        message: '¡Acabo de completar mi declaración de impuestos con Ross Tax! Fue súper fácil. Usa mi código de referido para obtener descuento: ROSSTAX2025 🎉',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleGoHome = () => {
    router.replace('/(tabs)');
  };

  const handleViewStatus = () => {
    router.push('/(tabs)/profile');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ECFDF5" />
      
      <View style={styles.content}>
        {/* Success Icon */}
        <Animated.View style={[styles.iconContainer, iconStyle]}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={60} color="#fff" />
          </View>
        </Animated.View>

        {/* Success Message */}
        <Animated.View style={[styles.messageContainer, contentStyle]}>
          <Text style={styles.title}>{t('services.declarationReady')} 🎉</Text>
          <Text style={styles.subtitle}>{t('wizard.successSubmitted', 'Your tax return has been submitted')}</Text>
          
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={24} color="#10B981" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>{t('wizard.whatsNext', "What's next?")}</Text>
              <Text style={styles.infoText}>
                • {t('wizard.confirmationEmail', 'You will receive email confirmation')}{'\n'}
                • {t('wizard.irsProcessing', 'The IRS will process your return (24-48h)')}{'\n'}
                • {t('wizard.notifyAccepted', 'We will notify you when accepted')}{'\n'}
                • {t('wizard.refundArrival', 'Your refund will arrive in 7-21 days')}
              </Text>
            </View>
          </View>

          <View style={styles.trackingCard}>
            <Text style={styles.trackingLabel}>{t('wizard.confirmationNumber', 'Confirmation number')}</Text>
            <Text style={styles.trackingNumber}>RT-2025-{sessionId?.slice(-6).toUpperCase() || 'XXXXXX'}</Text>
            <Text style={styles.trackingNote}>{t('wizard.saveNumber', 'Save this number for tracking')}</Text>
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[styles.actions, contentStyle]}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleViewStatus}>
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>{t('wizard.viewReturnStatus', 'View Return Status')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
            <Ionicons name="share-social" size={20} color="#10B981" />
            <Text style={styles.secondaryButtonText}>{t('wizard.shareWithFriends', 'Share with friends')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={handleGoHome}>
            <Text style={styles.linkButtonText}>{t('services.goHome')}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Help */}
        <Animated.View style={[styles.helpSection, contentStyle]}>
          <Text style={styles.helpText}>
            ¿Preguntas? Llámanos al{' '}
            <Text style={styles.helpLink}>806-934-2018</Text>
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECFDF5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  messageContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#047857',
    marginBottom: 24,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  trackingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  trackingLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  trackingNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#065F46',
    letterSpacing: 2,
  },
  trackingNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  actions: {
    width: '100%',
    marginTop: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
  helpSection: {
    marginTop: 'auto',
    paddingBottom: 40,
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  helpLink: {
    color: '#10B981',
    fontWeight: '600',
  },
});
