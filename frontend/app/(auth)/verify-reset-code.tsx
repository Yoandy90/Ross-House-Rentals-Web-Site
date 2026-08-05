import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function VerifyResetCode() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; credential?: string; method?: string }>();
  
  // Support both old (email) and new (credential, method) params
  const credential = params.credential || params.email || '';
  const method = params.method || 'email';
  const isPhone = method === 'phone' || (!credential.includes('@') && /^\d+$/.test(credential.replace(/\D/g, '')));
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  // Refs para los inputs
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    // Auto focus on first input
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    // Only allow numbers
    if (text && !/^\d+$/.test(text)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-advance to next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const fullCode = code.join('');
    
    if (fullCode.length !== 6) {
      Alert.alert('Error', 'Por favor ingresa el código completo de 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      // Build payload based on method
      const payload = isPhone 
        ? { phone_number: credential.replace(/\D/g, ''), code: fullCode }
        : { email: credential, code: fullCode };
      
      const response = await api.post('/auth/verify-reset-code', payload);
      
      if (response.data.success) {
        // Navigate to reset password screen
        router.push({
          pathname: '/(auth)/reset-password',
          params: { credential, method, code: fullCode }
        });
      }
    } catch (error: any) {
      console.error('Error verifying code:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Código inválido o expirado. Por favor verifica e intenta de nuevo.'
      );
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      // Build payload based on method
      const payload = isPhone 
        ? { phone_number: credential.replace(/\D/g, '') }
        : { email: credential };
      
      const response = await api.post('/auth/forgot-password', payload);
      
      if (response.data.success) {
        const methodText = isPhone ? 'SMS' : 'correo electrónico';
        Alert.alert(
          'Código Reenviado',
          `Se ha enviado un nuevo código a tu ${methodText}`
        );
        // Clear current code
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      console.error('Error resending code:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Error al reenviar el código. Por favor intenta de nuevo.'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <LinearGradient
              colors={['#8B0000', '#DC143C', '#4682B4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.header, { paddingTop: insets.top + 20 }]}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.headerContent}>
                <Ionicons name="shield-checkmark-outline" size={60} color="#fff" />
                <Text style={styles.headerTitle}>{t('auth.verifyCode')}</Text>
                <Text style={styles.headerSubtitle}>
                  {t('auth.verifySubtitle')}
                </Text>
                <Text style={styles.emailText}>{credential}</Text>
              </View>
            </LinearGradient>

            {/* Content Section */}
            <View style={styles.contentSection}>
              {/* Info Card */}
              <View style={styles.infoCard}>
                <Ionicons name="time-outline" size={24} color={colors.primary} />
                <Text style={styles.infoText}>
                  El código expira en 15 minutos
                </Text>
              </View>

              {/* Code Input */}
              <Text style={styles.label}>Código de Verificación</Text>
              <View style={styles.codeContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => inputRefs.current[index] = ref}
                    style={[
                      styles.codeInput,
                      digit ? styles.codeInputFilled : null
                    ]}
                    value={digit}
                    onChangeText={(text) => handleCodeChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    editable={!loading}
                  />
                ))}
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
                onPress={handleVerifyCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.verifyButtonText}>{t('auth.verifyButton')}</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Resend Code */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>{t('auth.codeNotReceived')}</Text>
                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={resending}
                  style={styles.resendButton}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.resendButtonText}>{t('auth.resendCode')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 4,
    borderLeftColor: '#FFA000',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000',
  },
  codeInputFilled: {
    borderColor: colors.primary,
    backgroundColor: '#fff',
  },
  verifyButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    flexDirection: 'row',
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});
