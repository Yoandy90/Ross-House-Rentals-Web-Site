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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function ResetPassword() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; credential?: string; method?: string; code: string }>();
  
  // Support both old (email) and new (credential, method) params
  const credential = params.credential || params.email || '';
  const method = params.method || 'email';
  const code = params.code;
  const isPhone = method === 'phone' || (!credential.includes('@') && /^\d+$/.test(credential.replace(/\D/g, '')));
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePassword = () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return false;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', t('auth.errorPasswordLength'));
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', t('auth.errorPasswordMatch'));
      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) {
      return;
    }

    setLoading(true);
    try {
      // Build payload based on method
      const payload = isPhone 
        ? { phone_number: credential.replace(/\D/g, ''), code, new_password: newPassword }
        : { email: credential, code, new_password: newPassword };
      
      const response = await api.post('/auth/reset-password', payload);
      
      if (response.data.success) {
        Alert.alert(
          t('auth.passwordResetSuccess'),
          'Tu contraseña ha sido actualizada exitosamente. Ahora puedes iniciar sesión con tu nueva contraseña.',
          [
            {
              text: 'Ir al Login',
              onPress: () => {
                router.replace('/(auth)/login');
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Error al restablecer la contraseña. Por favor intenta de nuevo.'
      );
    } finally {
      setLoading(false);
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
                <Ionicons name="key-outline" size={60} color="#fff" />
                <Text style={styles.headerTitle}>{t('auth.newPassword')}</Text>
                <Text style={styles.headerSubtitle}>
                  Ingresa tu nueva contraseña
                </Text>
              </View>
            </LinearGradient>

            {/* Content Section */}
            <View style={styles.contentSection}>
              {/* Info Card */}
              <View style={styles.infoCard}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#4CAF50" />
                <Text style={styles.infoText}>
                  Tu identidad ha sido verificada correctamente
                </Text>
              </View>

              {/* New Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('auth.newPassword')}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t("auth.passwordPlaceholder")}
                    placeholderTextColor="#999"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t("auth.confirmPlaceholder")}
                    placeholderTextColor="#999"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password Requirements */}
              <View style={styles.requirementsCard}>
                <Text style={styles.requirementsTitle}>Requisitos de contraseña:</Text>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={newPassword.length >= 6 ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={newPassword.length >= 6 ? "#4CAF50" : "#999"} 
                  />
                  <Text style={[
                    styles.requirementText,
                    newPassword.length >= 6 && styles.requirementTextMet
                  ]}>
                    {t('auth.passwordPlaceholder')}
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons 
                    name={newPassword && confirmPassword && newPassword === confirmPassword ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={newPassword && confirmPassword && newPassword === confirmPassword ? "#4CAF50" : "#999"} 
                  />
                  <Text style={[
                    styles.requirementText,
                    newPassword && confirmPassword && newPassword === confirmPassword && styles.requirementTextMet
                  ]}>
                    {t('auth.errorPasswordMatch')}
                  </Text>
                </View>
              </View>

              {/* Reset Button */}
              <TouchableOpacity
                style={[styles.resetButton, loading && styles.resetButtonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done-outline" size={20} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.resetButtonText}>Actualizar Contraseña</Text>
                  </>
                )}
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
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
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
  inputContainer: {
    marginBottom: 20,
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
  eyeIcon: {
    padding: 16,
  },
  requirementsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  requirementTextMet: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  resetButton: {
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
  resetButtonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
