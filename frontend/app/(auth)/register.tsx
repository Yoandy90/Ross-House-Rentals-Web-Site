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
  Animated,
  Dimensions,
  Linking,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeColors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../i18n/config';
import { LinearGradient } from 'expo-linear-gradient';
import { LocationOnboardingModal } from '../../components/LocationOnboardingModal';
import { useLocationOnboarding } from '../../hooks/useLocationOnboarding';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function Register() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Step 1: Personal Info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [selectedLanguage, setSelectedLanguage] = useState('es');

  // Step 2: Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Step 3: Security
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  
  const { 
    loading: locationLoading, 
    handleAccept: acceptLocation, 
    handleDecline: declineLocation 
  } = useLocationOnboarding();

  // Change language in real-time when user selects
  useEffect(() => {
    changeLanguage(selectedLanguage);
  }, [selectedLanguage]);

  const validatePhoneNumber = (phone: string, countryCode: string): boolean => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (countryCode === '+1' || countryCode === '+52') {
      return digitsOnly.length === 10;
    }
    return false;
  };

  const formatPhoneNumber = (phone: string, countryCode: string): string => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (countryCode === '+1') {
      if (digitsOnly.length <= 3) return digitsOnly;
      if (digitsOnly.length <= 6) return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
    } else if (countryCode === '+52') {
      if (digitsOnly.length <= 3) return digitsOnly;
      if (digitsOnly.length <= 6) return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3)}`;
      return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6, 10)}`;
    }
    return phone;
  };

  // Translations for each step
  const getSteps = () => [
    { 
      title: t('register.steps.info', 'Información'), 
      icon: 'person', 
      subtitle: t('register.steps.infoSub', 'Datos personales') 
    },
    { 
      title: t('register.steps.address', 'Dirección'), 
      icon: 'location', 
      subtitle: t('register.steps.addressSub', 'Tu ubicación') 
    },
    { 
      title: t('register.steps.security', 'Seguridad'), 
      icon: 'shield-checkmark', 
      subtitle: t('register.steps.securitySub', 'Protege tu cuenta') 
    },
  ];

  const steps = getSteps();

  const validateStep = () => {
    switch (currentStep) {
      case 0:
        if (!name.trim()) {
          Alert.alert(t('common.error', 'Error'), t('register.errors.nameRequired', 'Por favor ingresa tu nombre completo'));
          return false;
        }
        if (!email.trim() || !email.includes('@')) {
          Alert.alert(t('common.error', 'Error'), t('register.errors.emailInvalid', 'Por favor ingresa un email válido'));
          return false;
        }
        if (phone.trim() && !validatePhoneNumber(phone, countryCode)) {
          Alert.alert(t('register.errors.phoneInvalid', 'Teléfono Inválido'), t('register.errors.phone10Digits', 'Por favor ingresa un número de 10 dígitos'));
          return false;
        }
        return true;
      case 1:
        if (!addressLine1.trim()) {
          Alert.alert(t('common.error', 'Error'), t('register.errors.addressRequired', 'Por favor ingresa tu dirección'));
          return false;
        }
        if (!city.trim() || !state.trim() || !zipCode.trim()) {
          Alert.alert(t('common.error', 'Error'), t('register.errors.addressComplete', 'Por favor completa ciudad, estado y código postal'));
          return false;
        }
        return true;
      case 2:
        if (password.length < 6) {
          Alert.alert(t('common.error', 'Error'), t('register.errors.passwordMin', 'La contraseña debe tener al menos 6 caracteres'));
          return false;
        }
        if (password !== confirmPassword) {
          Alert.alert(t('common.error', 'Error'), t('register.errors.passwordMatch', 'Las contraseñas no coinciden'));
          return false;
        }
        if (!acceptedTerms) {
          Alert.alert(t('common.error', 'Error'), t('register.errors.termsRequired', 'Debes aceptar los Términos y Política de Privacidad'));
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < steps.length - 1) {
        // Fade out animation
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          const nextStep = currentStep + 1;
          setCurrentStep(nextStep);
          Animated.spring(progressAnim, {
            toValue: nextStep,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
          scrollViewRef.current?.scrollTo({ y: 0, animated: false });
          // Fade in animation
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });
      } else {
        handleRegister();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        const prevStep = currentStep - 1;
        setCurrentStep(prevStep);
        Animated.spring(progressAnim, {
          toValue: prevStep,
          useNativeDriver: false,
          tension: 50,
          friction: 7,
        }).start();
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    } else {
      router.back();
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      await changeLanguage(selectedLanguage);
      const address = {
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        zip_code: zipCode,
      };
      const fullPhone = phone ? `${countryCode}${phone.replace(/\D/g, '')}` : undefined;
      await signUp(email, password, name, fullPhone, address);
      setShowLocationModal(true);
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail || '';
      if (errorDetail.toLowerCase().includes('already registered') || 
          errorDetail.toLowerCase().includes('ya registrado') ||
          errorDetail.toLowerCase().includes('already exists')) {
        Alert.alert(
          t('register.errors.accountExists', '¡Ya tienes una cuenta!'),
          t('register.errors.emailRegistered', `El email ${email} ya está registrado.`),
          [
            { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
            { text: t('auth.signIn', 'Iniciar Sesión'), onPress: () => router.push('/(auth)/login') },
            { text: t('auth.forgotPassword', 'Recuperar Contraseña'), onPress: () => router.push('/(auth)/forgot-password') },
          ]
        );
      } else {
        Alert.alert(t('common.error', 'Error'), errorDetail || t('auth.registerError', 'Error al registrar'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLocationAccept = async () => {
    await acceptLocation();
    setShowLocationModal(false);
    router.replace('/(tabs)/');
  };

  const handleLocationDecline = async () => {
    await declineLocation();
    setShowLocationModal(false);
    router.replace('/(tabs)/');
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return { level: 0, text: '', color: '#E5E7EB' };
    if (password.length < 6) return { level: 1, text: t('register.passwordWeak', 'Débil'), color: '#EF4444' };
    if (password.length < 8) return { level: 2, text: t('register.passwordMedium', 'Media'), color: '#F59E0B' };
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { level: 3, text: t('register.passwordStrong', 'Fuerte'), color: '#10B981' };
    return { level: 2, text: t('register.passwordMedium', 'Media'), color: '#F59E0B' };
  };

  const passwordStrength = getPasswordStrength();

  const renderInput = (
    icon: string,
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    options: {
      keyboardType?: any;
      autoCapitalize?: any;
      secureTextEntry?: boolean;
      showToggle?: boolean;
      isPasswordVisible?: boolean;
      onTogglePassword?: () => void;
      maxLength?: number;
    } = {}
  ) => (
    <View style={styles.inputContainer}>
      <View style={styles.inputIconContainer}>
        <Ionicons name={icon as any} size={20} color="#10B981" />
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        keyboardType={options.keyboardType}
        autoCapitalize={options.autoCapitalize}
        secureTextEntry={options.secureTextEntry && !options.isPasswordVisible}
        maxLength={options.maxLength}
      />
      {options.showToggle && (
        <TouchableOpacity 
          onPress={options.onTogglePassword}
          style={styles.eyeButton}
        >
          <Ionicons 
            name={options.isPasswordVisible ? 'eye-off-outline' : 'eye-outline'} 
            size={20} 
            color="#6B7280" 
          />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            {/* Name Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('register.fullName', 'Nombre Completo')}</Text>
              {renderInput('person-outline', t('register.namePlaceholder', 'Juan Pérez'), name, setName, { autoCapitalize: 'words' })}
            </View>

            {/* Email Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('register.email', 'Correo Electrónico')}</Text>
              {renderInput('mail-outline', t('register.emailPlaceholder', 'tu@email.com'), email, setEmail, { 
                keyboardType: 'email-address', 
                autoCapitalize: 'none' 
              })}
            </View>

            {/* Phone Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {t('register.phone', 'Teléfono')} <Text style={styles.optionalText}>({t('common.optional', 'Opcional')})</Text>
              </Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity 
                  style={styles.countryCodeButton}
                  onPress={() => setCountryCode(countryCode === '+1' ? '+52' : '+1')}
                >
                  <Text style={styles.flagText}>{countryCode === '+1' ? '🇺🇸' : '🇲🇽'}</Text>
                  <Text style={styles.codeText}>{countryCode}</Text>
                  <Ionicons name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                <View style={styles.phoneInputContainer}>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder={countryCode === '+1' ? '(555) 123-4567' : '555 123 4567'}
                    placeholderTextColor="#9CA3AF"
                    value={phone}
                    onChangeText={(text) => setPhone(formatPhoneNumber(text, countryCode))}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            {/* Language Selection */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('register.preferredLanguage', 'Idioma Preferido')}</Text>
              <View style={styles.languageRow}>
                <TouchableOpacity 
                  style={[styles.languageButton, selectedLanguage === 'es' && styles.languageButtonActive]}
                  onPress={() => setSelectedLanguage('es')}
                >
                  <Text style={styles.languageFlag}>🇪🇸</Text>
                  <Text style={[styles.languageText, selectedLanguage === 'es' && styles.languageTextActive]}>
                    Español
                  </Text>
                  {selectedLanguage === 'es' && (
                    <View style={styles.languageCheck}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.languageButton, selectedLanguage === 'en' && styles.languageButtonActive]}
                  onPress={() => setSelectedLanguage('en')}
                >
                  <Text style={styles.languageFlag}>🇺🇸</Text>
                  <Text style={[styles.languageText, selectedLanguage === 'en' && styles.languageTextActive]}>
                    English
                  </Text>
                  {selectedLanguage === 'en' && (
                    <View style={styles.languageCheck}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        );

      case 1:
        return (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            {/* Address Line 1 */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('register.address', 'Dirección')}</Text>
              {renderInput('home-outline', t('register.addressPlaceholder', '123 Main Street'), addressLine1, setAddressLine1, { autoCapitalize: 'words' })}
            </View>

            {/* Address Line 2 */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {t('register.addressLine2', 'Apt, Suite, etc.')} <Text style={styles.optionalText}>({t('common.optional', 'Opcional')})</Text>
              </Text>
              {renderInput('business-outline', t('register.addressLine2Placeholder', 'Apt 4B'), addressLine2, setAddressLine2, { autoCapitalize: 'words' })}
            </View>

            {/* City */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('register.city', 'Ciudad')}</Text>
              {renderInput('location-outline', t('register.cityPlaceholder', 'Miami'), city, setCity, { autoCapitalize: 'words' })}
            </View>

            {/* State and Zip Row */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>{t('register.state', 'Estado')}</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, { paddingLeft: 16 }]}
                    placeholder="TX"
                    placeholderTextColor="#9CA3AF"
                    value={state}
                    onChangeText={setState}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
              </View>
              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>{t('register.zipCode', 'Código Postal')}</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, { paddingLeft: 16 }]}
                    placeholder="79936"
                    placeholderTextColor="#9CA3AF"
                    value={zipCode}
                    onChangeText={setZipCode}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
              </View>
            </View>
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('register.password', 'Contraseña')}</Text>
              {renderInput('lock-closed-outline', t('register.passwordPlaceholder', 'Mínimo 6 caracteres'), password, setPassword, {
                secureTextEntry: true,
                showToggle: true,
                isPasswordVisible: showPassword,
                onTogglePassword: () => setShowPassword(!showPassword),
                autoCapitalize: 'none'
              })}
              
              {/* Password Strength */}
              <View style={styles.strengthRow}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3].map((level) => (
                    <View 
                      key={level}
                      style={[
                        styles.strengthBar,
                        { backgroundColor: passwordStrength.level >= level ? passwordStrength.color : '#E5E7EB' }
                      ]} 
                    />
                  ))}
                </View>
                {passwordStrength.text && (
                  <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                    {passwordStrength.text}
                  </Text>
                )}
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('register.confirmPassword', 'Confirmar Contraseña')}</Text>
              {renderInput('lock-closed-outline', t('register.confirmPasswordPlaceholder', 'Repetir contraseña'), confirmPassword, setConfirmPassword, {
                secureTextEntry: true,
                showToggle: true,
                isPasswordVisible: showConfirmPassword,
                onTogglePassword: () => setShowConfirmPassword(!showConfirmPassword),
                autoCapitalize: 'none'
              })}
              {confirmPassword.length > 0 && password === confirmPassword && (
                <View style={styles.matchIndicator}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.matchText}>{t('register.passwordsMatch', 'Las contraseñas coinciden')}</Text>
                </View>
              )}
            </View>

            {/* Terms */}
            <TouchableOpacity 
              style={styles.termsRow}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
              <Text style={styles.termsText}>
                {t('register.acceptTerms', 'Acepto los')}{' '}
                <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.rosstaxpreparation.com/terms')}>
                  {t('register.terms', 'Términos')}
                </Text>
                {' '}{t('common.and', 'y')}{' '}
                <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.rosstaxpreparation.com/privacy')}>
                  {t('register.privacy', 'Privacidad')}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Security Badge */}
            <View style={styles.securityBadge}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']}
                style={styles.securityGradient}
              >
                <Ionicons name="shield-checkmark" size={22} color="#10B981" />
                <Text style={styles.securityText}>
                  {t('register.securityNote', 'Datos protegidos con encriptación SSL de 256-bit')}
                </Text>
              </LinearGradient>
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, steps.length - 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#064E3B', '#065F46', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('register.createAccount', 'Crear Cuenta')}</Text>
            <Text style={styles.headerSubtitle}>Ross Tax Preparation</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <View style={styles.stepsRow}>
            {steps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  index <= currentStep && styles.stepDotActive,
                  index < currentStep && styles.stepDotCompleted
                ]}>
                  {index < currentStep ? (
                    <Ionicons name="checkmark" size={12} color="#FFF" />
                  ) : (
                    <Text style={[styles.stepNumber, index <= currentStep && styles.stepNumberActive]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, index === currentStep && styles.stepLabelActive]}>
                  {step.title}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Step Info Card */}
        <View style={styles.stepCard}>
          <View style={styles.stepIconContainer}>
            <Ionicons name={steps[currentStep].icon as any} size={24} color="#10B981" />
          </View>
          <View style={styles.stepInfo}>
            <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
            <Text style={styles.stepSubtitle}>{steps[currentStep].subtitle}</Text>
          </View>
          <Text style={styles.stepCounter}>
            {currentStep + 1}/{steps.length}
          </Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStepContent()}

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.continueButton, loading && styles.continueButtonDisabled]}
            onPress={handleNext}
            disabled={loading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueGradient}
            >
              {loading ? (
                <Text style={styles.continueText}>{t('register.creating', 'Creando cuenta...')}</Text>
              ) : (
                <>
                  <Text style={styles.continueText}>
                    {currentStep === steps.length - 1 
                      ? t('register.createAccountButton', 'Crear Cuenta') 
                      : t('common.continue', 'Continuar')
                    }
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Login Link */}
          {currentStep === 0 && (
            <TouchableOpacity 
              onPress={() => router.push('/(auth)/login')} 
              style={styles.loginLink}
            >
              <Text style={styles.loginLinkText}>
                {t('register.haveAccount', '¿Ya tienes cuenta?')}{' '}
                <Text style={styles.loginLinkBold}>{t('auth.signIn', 'Inicia sesión')}</Text>
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationOnboardingModal
        visible={showLocationModal}
        onAccept={handleLocationAccept}
        onDecline={handleLocationDecline}
        loading={locationLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerGradient: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  headerSpacer: {
    width: 44,
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  stepDotActive: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  stepDotCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  stepNumberActive: {
    color: '#047857',
  },
  stepLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 6,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: -16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  stepIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepInfo: {
    flex: 1,
    marginLeft: 12,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  stepContent: {
    gap: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 4,
  },
  optionalText: {
    fontWeight: '400',
    color: '#9CA3AF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  inputIconContainer: {
    width: 48,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  eyeButton: {
    padding: 14,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  flagText: {
    fontSize: 20,
  },
  codeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  phoneInputContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  phoneInput: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  languageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  languageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  languageButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: '#10B981',
    borderWidth: 2,
  },
  languageFlag: {
    fontSize: 22,
  },
  languageText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  languageTextActive: {
    color: '#10B981',
    fontWeight: '600',
  },
  languageCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowFields: {
    flexDirection: 'row',
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  strengthBars: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  matchText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  termsLink: {
    color: '#10B981',
    fontWeight: '600',
  },
  securityBadge: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  securityGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  continueButton: {
    marginTop: 28,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loginLinkText: {
    fontSize: 15,
    color: '#6B7280',
  },
  loginLinkBold: {
    color: '#10B981',
    fontWeight: '700',
  },
});
