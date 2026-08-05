import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function ForgotPassword() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);

  // Detect if input is email or phone
  const isEmail = (value: string) => {
    return value.includes('@');
  };

  const isPhone = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length >= 10 && !value.includes('@');
  };

  const getInputType = () => {
    if (!credential) return 'unknown';
    if (isEmail(credential)) return 'email';
    if (isPhone(credential)) return 'phone';
    return 'unknown';
  };

  const formatPhoneForDisplay = (value: string) => {
    // Remove all non-digits
    const digitsOnly = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digitsOnly.length <= 3) return digitsOnly;
    if (digitsOnly.length <= 6) return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
    if (digitsOnly.length <= 10) return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    return `+${digitsOnly.slice(0, digitsOnly.length - 10)} (${digitsOnly.slice(-10, -7)}) ${digitsOnly.slice(-7, -4)}-${digitsOnly.slice(-4)}`;
  };

  const handleInputChange = (text: string) => {
    // If it looks like a phone number (starts with digit or +), format it
    if (/^[\d+\s()-]*$/.test(text) && !text.includes('@')) {
      // Keep it as is for phone input, let user type freely
      setCredential(text);
    } else {
      setCredential(text);
    }
  };

  const handleSendCode = async () => {
    if (!credential) {
      Alert.alert('Error', t('auth.errorEnterCredential'));
      return;
    }

    const inputType = getInputType();

    // Validate email
    if (inputType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(credential)) {
        Alert.alert('Error', t('auth.errorInvalidEmail'));
        return;
      }
    }

    // Validate phone
    if (inputType === 'phone') {
      const digitsOnly = credential.replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        Alert.alert('Error', t('auth.errorInvalidPhone'));
        return;
      }
    }

    if (inputType === 'unknown') {
      Alert.alert('Error', t('auth.errorInvalidCredential'));
      return;
    }

    setLoading(true);
    try {
      // Prepare payload based on input type
      const payload = inputType === 'email' 
        ? { email: credential }
        : { phone_number: credential.replace(/\D/g, '') };

      const response = await api.post('/auth/forgot-password', payload);
      
      if (response.data.success) {
        // Navigate directly to verify code screen
        router.push({
          pathname: '/(auth)/verify-reset-code',
          params: { 
            credential,
            method: inputType
          }
        });
      }
    } catch (error: any) {
      console.error('Error sending reset code:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || t('auth.errorSendingCode')
      );
    } finally {
      setLoading(false);
    }
  };

  const inputType = getInputType();
  const inputIcon = inputType === 'phone' ? 'call-outline' : 'mail-outline';

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
                <Ionicons name="lock-closed-outline" size={60} color="#fff" />
                <Text style={styles.headerTitle}>{t('auth.recoverPassword')}</Text>
                <Text style={styles.headerSubtitle}>
                  {t('auth.recoverSubtitle')}
                </Text>
              </View>
            </LinearGradient>

            {/* Content Section */}
            <View style={styles.contentSection}>
              {/* Info Card */}
              <View style={styles.infoCard}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="mail-outline" size={18} color={colors.primary} />
                  <Text style={styles.infoSeparator}>/</Text>
                  <Ionicons name="call-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.infoText}>
                  {t('auth.receiveCode')} {inputType === 'phone' ? 'SMS' : 'email'}
                </Text>
              </View>

              {/* Unified Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('auth.emailOrPhone')}</Text>
                <View style={[
                  styles.inputWrapper,
                  inputType === 'phone' && styles.inputWrapperPhone,
                  inputType === 'email' && styles.inputWrapperEmail
                ]}>
                  <Ionicons 
                    name={inputIcon} 
                    size={20} 
                    color={inputType !== 'unknown' ? colors.primary : '#999'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="tu@email.com o +1 555-123-4567"
                    placeholderTextColor="#999"
                    value={credential}
                    onChangeText={handleInputChange}
                    autoCapitalize="none"
                    keyboardType={inputType === 'phone' ? 'phone-pad' : 'email-address'}
                    autoComplete={inputType === 'phone' ? 'tel' : 'email'}
                    editable={!loading}
                  />
                  {inputType !== 'unknown' && (
                    <View style={styles.inputTypeBadge}>
                      <Text style={styles.inputTypeBadgeText}>
                        {inputType === 'email' ? '📧' : '📱'}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Helper text */}
                <Text style={styles.helperText}>
                  {inputType === 'phone' 
                    ? t('auth.smsCode') 
                    : inputType === 'email'
                    ? t('auth.emailCode')
                    : t('auth.enterEmailOrPhoneRegistered')}
                </Text>
              </View>

              {/* Send Code Button */}
              <TouchableOpacity
                style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                onPress={handleSendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={20} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.sendButtonText}>{t('auth.sendCode')}</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Back to Login */}
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backToLoginButton}
              >
                <Ionicons name="arrow-back-outline" size={16} color={colors.primary} />
                <Text style={styles.backToLoginText}>{t('auth.backToLogin')}</Text>
              </TouchableOpacity>
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
    lineHeight: 22,
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  infoIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoSeparator: {
    marginHorizontal: 4,
    color: colors.primary,
    fontWeight: 'bold',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputWrapperPhone: {
    borderColor: '#4CAF50',
    backgroundColor: '#F0FFF0',
  },
  inputWrapperEmail: {
    borderColor: colors.primary,
    backgroundColor: '#FFF8F0',
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  inputTypeBadge: {
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  inputTypeBadgeText: {
    fontSize: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginLeft: 4,
  },
  sendButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
  sendButtonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  backToLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  backToLoginText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 6,
  },
});
