/**
 * Mi Reembolso - Personal Info Screen
 * Step 1: Collect taxpayer's personal information
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useAutoSave } from '../../hooks/useAutoSave';
import { AutoSaveIndicator } from '../../components/AutoSaveIndicator';
import { useTranslation } from 'react-i18next';

export default function PersonalInfoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ssn, setSsn] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  // USPS Address Validation
  const [uspsStatus, setUspsStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [uspsAddress, setUspsAddress] = useState('');

  const validateAddressUSPS = async () => {
    if (!street.trim()) return;
    setUspsStatus('validating');
    try {
      const res = await api.post('/usps/address/validate-simple', {
        street: street.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
      });
      if (res.data?.valid) {
        const std = res.data.standardized;
        setStreet(std.streetAddress || street);
        setCity(std.city || city);
        setState(std.state || state);
        setZip(std.ZIPCode || zip);
        setUspsAddress(res.data.fullAddress || '');
        setUspsStatus('valid');
      } else {
        setUspsStatus('invalid');
        setUspsAddress('');
      }
    } catch (e) {
      console.log('USPS validation error:', e);
      setUspsStatus('idle');
    }
  };

  // Auto-fill city/state when ZIP is entered
  const handleZipChange = async (value: string) => {
    setZip(value);
    setUspsStatus('idle');
    if (value.length === 5) {
      try {
        const res = await api.get(`/usps/zipcode/citystate/${value}`);
        if (res.data?.city) {
          setCity(res.data.city);
          setState(res.data.state);
        }
      } catch (e) {
        // ZIP not found, no auto-fill
      }
    }
  };

  // TIN Matching state
  const [tinVerifyStatus, setTinVerifyStatus] = useState<'idle' | 'verifying' | 'match' | 'no_match' | 'error'>('idle');
  const [tinVerifyMessage, setTinVerifyMessage] = useState('');
  const [tinVerified, setTinVerified] = useState(false);

  // Auto-save hook
  const { autoSaveState, triggerSave } = useAutoSave({
    sessionId,
    endpoint: 'personal-info',
    debounceMs: 1500,
    transformData: (data) => {
      let formattedDate = '';
      if (data.dateOfBirth) {
        const parts = data.dateOfBirth.split('/');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }
      return {
        first_name: data.firstName,
        middle_name: data.middleName,
        last_name: data.lastName,
        ssn_last_four: data.ssn.replace(/\D/g, '').slice(-4),
        ssn_encrypted: data.ssn.replace(/\D/g, ''),
        date_of_birth: formattedDate,
        phone: data.phone.replace(/\D/g, ''),
        email: data.email,
        address: data.street,
        city: data.city,
        state: data.state,
        zip_code: data.zip,
      };
    },
  });

  // Trigger auto-save when form data changes
  useEffect(() => {
    if (!loading && firstName) {
      triggerSave({ firstName, middleName, lastName, ssn, dateOfBirth, phone, email, street, city, state, zip });
    }
  }, [firstName, middleName, lastName, ssn, dateOfBirth, phone, email, street, city, state, zip, loading]);

  // Auto-verify TIN when SSN is complete (9 digits) and name is filled
  useEffect(() => {
    const cleanSSN = ssn.replace(/\D/g, '');
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    
    if (cleanSSN.length === 9 && fullName.length >= 2 && !tinVerified) {
      const timer = setTimeout(() => {
        verifyTINWithIRS(cleanSSN, fullName);
      }, 800); // debounce
      return () => clearTimeout(timer);
    }
  }, [ssn, firstName, lastName]);

  const verifyTINWithIRS = async (tin: string, name: string) => {
    setTinVerifyStatus('verifying');
    setTinVerifyMessage('');
    try {
      const response = await api.post('/tin-matching/verify', {
        tin: tin,
        name: name,
        tin_type: 'SSN',
      });
      
      if (response.data.success !== false) {
        const status = response.data.status || response.data.response_code;
        if (status === 'match' || response.data.response_code === '0') {
          setTinVerifyStatus('match');
          setTinVerifyMessage(t('wizard.tinMatch', 'SSN verificado con el IRS'));
          setTinVerified(true);
        } else {
          setTinVerifyStatus('no_match');
          setTinVerifyMessage(response.data.message || t('wizard.tinNoMatch', 'SSN no coincide con registros del IRS'));
          setTinVerified(true);
        }
      } else {
        setTinVerifyStatus('error');
        setTinVerifyMessage(t('wizard.tinError', 'No se pudo verificar con el IRS'));
      }
    } catch (error: any) {
      console.log('TIN verify error (non-blocking):', error?.message);
      setTinVerifyStatus('error');
      setTinVerifyMessage(t('wizard.tinUnavailable', 'Verificación IRS no disponible'));
    }
  };

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const response = await api.get(`/tax-wizard/session/${sessionId}`);
      if (response.data.success && response.data.session.personal_info) {
        const info = response.data.session.personal_info;
        setFirstName(info.first_name || '');
        setMiddleName(info.middle_name || '');
        setLastName(info.last_name || '');
        // SSN can be stored as 'ssn', 'ssn_encrypted', or formatted
        const savedSSN = info.ssn || info.ssn_encrypted || '';
        if (savedSSN && savedSSN.replace(/\D/g, '').length === 9) {
          setSsn(formatSSN(savedSSN.replace(/\D/g, '')));
        } else {
          setSsn('');
        }
        setDateOfBirth(info.date_of_birth || '');
        setPhone(info.phone || '');
        setEmail(info.email || '');
        if (info.address) {
          setStreet(info.address.street || '');
          setCity(info.address.city || '');
          setState(info.address.state || '');
          setZip(info.address.zip || '');
        }
        
        // If session exists but SSN is missing, try to prefill SSN from profile/banking records
        if (!savedSSN || savedSSN.replace(/\D/g, '').length !== 9) {
          try {
            const prefillRes = await api.get('/profile/tax-prefill');
            const pf = prefillRes.data;
            if (pf.ssn && pf.ssn.length === 9) {
              setSsn(formatSSN(pf.ssn));
            }
          } catch (e) {
            // SSN prefill not critical
          }
        }
      } else {
        // NEW SESSION: Pre-fill from client profile
        await loadProfilePrefill();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Try pre-fill as fallback
      await loadProfilePrefill();
    } finally {
      setLoading(false);
    }
  };

  const loadProfilePrefill = async () => {
    try {
      const prefillResponse = await api.get('/profile/tax-prefill');
      const prefill = prefillResponse.data;
      
      if (prefill.has_profile_data) {
        if (prefill.first_name) setFirstName(prefill.first_name);
        if (prefill.middle_name) setMiddleName(prefill.middle_name);
        if (prefill.last_name) setLastName(prefill.last_name);
        if (prefill.phone) setPhone(prefill.phone);
        if (prefill.email) setEmail(prefill.email);
        if (prefill.date_of_birth) {
          // Convert from YYYY-MM-DD to MM/DD/YYYY for display
          const parts = prefill.date_of_birth.split('-');
          if (parts.length === 3) {
            setDateOfBirth(`${parts[1]}/${parts[2]}/${parts[0]}`);
          } else {
            setDateOfBirth(prefill.date_of_birth);
          }
        }
        if (prefill.address) {
          if (prefill.address.street) setStreet(prefill.address.street);
          if (prefill.address.city) setCity(prefill.address.city);
          if (prefill.address.state) setState(prefill.address.state);
          if (prefill.address.zip) setZip(prefill.address.zip);
        }
        
        // Pre-fill SSN for returning clients
        if (prefill.ssn && prefill.ssn.length === 9) {
          setSsn(formatSSN(prefill.ssn));
        }
        
        const hasSSN = prefill.ssn && prefill.ssn.length === 9;
        const ssnMsg = hasSSN 
          ? `\n\n🔐 ${t('wizard.ssnPrefilled', 'Tu SSN ha sido pre-llenado de tus registros anteriores.')}`
          : '';
        
        Alert.alert(
          '✅ ' + t('wizard.dataPrefilled', 'Datos Pre-llenados'),
          t('wizard.prefillMessage', 'Hemos pre-llenado tus datos desde tu perfil. Revisa y completa la información faltante.') + ssnMsg,
          [{ text: t('wizard.personalInfoWiz.understood'), style: 'default' }]
        );
      }
    } catch (error) {
    }
  };

  const formatSSN = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 9)}`;
  };

  const formatDate = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  const validateForm = () => {
    if (!firstName.trim()) {
      Alert.alert(t('common.error'), t('wizard.personalInfoWiz.enterFirstName'));
      return false;
    }
    if (!lastName.trim()) {
      Alert.alert(t('common.error'), t('wizard.personalInfoWiz.enterLastName'));
      return false;
    }
    if (!ssn || ssn.replace(/\D/g, '').length !== 9) {
      Alert.alert(t('common.error'), t('wizard.personalInfoWiz.enterSSN'));
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Convert date format from MM/DD/YYYY to YYYY-MM-DD
      let formattedDate = '';
      if (dateOfBirth) {
        const parts = dateOfBirth.split('/');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }

      const response = await api.post(`/tax-wizard/session/${sessionId}/personal-info`, {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        ssn_last_four: ssn.replace(/\D/g, '').slice(-4),
        ssn_encrypted: ssn.replace(/\D/g, ''),
        date_of_birth: formattedDate,
        phone: phone.replace(/\D/g, ''),
        email: email,
        address: street,
        city: city,
        state: state,
        zip_code: zip,
        tin_verified: tinVerifyStatus === 'match',
        tin_verify_status: tinVerifyStatus,
      });

      if (response.data.success) {
        // Sync data back to client profile (bi-directional sync)
        try {
          await api.put('/client-profile', {
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            name: [firstName, middleName, lastName].filter(Boolean).join(' '),
            phone: phone.replace(/\D/g, ''),
            date_of_birth: formattedDate,
            address: {
              street: street,
              city: city,
              state: state,
              zip_code: zip,
              country: 'Estados Unidos',
            },
          });
        } catch (syncError) {
        }
        
        router.push({
          pathname: '/tax-wizard/filing-status',
          params: { sessionId }
        });
      }
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', 'No se pudo guardar la información');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#065F46" />
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065F46" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/tax-wizard/discovery',
                params: { sessionId }
              })} 
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{t('wizard.personalInfoWiz.title')}</Text>
              <Text style={styles.headerStep}>{t('wizard.personalInfoWiz.stepOf', { current: 1, total: 6 })}</Text>
            </View>
            <AutoSaveIndicator state={autoSaveState} />
          </View>
          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '16.6%' }]} />
            </View>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>{t('wizard.personalInfoWiz.taxpayerData')}</Text>

          {/* Name */}
          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>{t('personalInfo.firstName')} *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Juan"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>{t('personalInfo.middleName')}</Text>
              <TextInput
                style={styles.input}
                value={middleName}
                onChangeText={setMiddleName}
                placeholder="Carlos"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('personalInfo.lastName')} *</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('wizard.lastNamePlaceholder', 'Pérez')}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* SSN & DOB */}
          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>SSN *</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[
                    styles.input,
                    tinVerifyStatus === 'match' && { borderColor: '#10B981', borderWidth: 2 },
                    tinVerifyStatus === 'no_match' && { borderColor: '#F59E0B', borderWidth: 2 },
                  ]}
                  value={ssn}
                  onChangeText={(v) => {
                    setSsn(formatSSN(v));
                    // Reset verification if SSN changes
                    if (tinVerified) {
                      setTinVerified(false);
                      setTinVerifyStatus('idle');
                      setTinVerifyMessage('');
                    }
                  }}
                  placeholder="XXX-XX-XXXX"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={11}
                  secureTextEntry
                />
                {/* TIN Verification Status Icon */}
                {tinVerifyStatus === 'verifying' && (
                  <View style={styles.tinStatusIcon}>
                    <ActivityIndicator size="small" color="#3B82F6" />
                  </View>
                )}
                {tinVerifyStatus === 'match' && (
                  <View style={styles.tinStatusIcon}>
                    <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                  </View>
                )}
                {tinVerifyStatus === 'no_match' && (
                  <View style={styles.tinStatusIcon}>
                    <Ionicons name="warning" size={20} color="#F59E0B" />
                  </View>
                )}
                {tinVerifyStatus === 'error' && (
                  <View style={styles.tinStatusIcon}>
                    <Ionicons name="information-circle" size={20} color="#9CA3AF" />
                  </View>
                )}
              </View>
              {/* TIN Verification Message */}
              {tinVerifyStatus !== 'idle' && tinVerifyMessage !== '' && (
                <View style={[
                  styles.tinMessageBox,
                  tinVerifyStatus === 'match' && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                  tinVerifyStatus === 'no_match' && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                  tinVerifyStatus === 'error' && { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
                ]}>
                  <Text style={[
                    styles.tinMessageText,
                    tinVerifyStatus === 'match' && { color: '#065F46' },
                    tinVerifyStatus === 'no_match' && { color: '#92400E' },
                    tinVerifyStatus === 'error' && { color: '#6B7280' },
                  ]}>
                    {tinVerifyStatus === 'match' && '✅ '}{tinVerifyStatus === 'no_match' && '⚠️ '}{tinVerifyMessage}
                  </Text>
                </View>
              )}
              {tinVerifyStatus === 'verifying' && (
                <Text style={styles.tinVerifyingText}>
                  {t('wizard.tinVerifying', 'Verificando con el IRS...')}
                </Text>
              )}
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>{t('personalInfo.dateOfBirth')}</Text>
              <TextInput
                style={styles.input}
                value={dateOfBirth}
                onChangeText={(v) => setDateOfBirth(formatDate(v))}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* Contact */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('wizard.personalInfoWiz.contact')}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('personalInfo.phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(v) => setPhone(formatPhone(v))}
              placeholder="(806) 123-4567"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={14}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('personalInfo.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="juan@email.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Address */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('wizard.personalInfoWiz.address')}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('wizard.personalInfoWiz.street')}</Text>
            <TextInput
              style={styles.input}
              value={street}
              onChangeText={(v) => { setStreet(v); setUspsStatus('idle'); }}
              placeholder="123 Main Street"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>{t('personalInfo.city')}</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Dumas"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={styles.inputQuarter}>
              <Text style={styles.label}>{t('personalInfo.state')}</Text>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={setState}
                placeholder="TX"
                placeholderTextColor="#9CA3AF"
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.inputQuarter}>
              <Text style={styles.label}>ZIP</Text>
              <TextInput
                style={styles.input}
                value={zip}
                onChangeText={handleZipChange}
                placeholder="79029"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          </View>

          {/* USPS Validate Button */}
          {street.trim().length > 3 && (
            <TouchableOpacity
              style={[styles.uspsButton, uspsStatus === 'valid' && styles.uspsButtonValid, uspsStatus === 'invalid' && styles.uspsButtonInvalid]}
              onPress={validateAddressUSPS}
              disabled={uspsStatus === 'validating'}
            >
              {uspsStatus === 'validating' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name={uspsStatus === 'valid' ? 'checkmark-circle' : uspsStatus === 'invalid' ? 'alert-circle' : 'mail'}
                  size={18}
                  color="#fff"
                />
              )}
              <Text style={styles.uspsButtonText}>
                {uspsStatus === 'valid'
                  ? `✅ ${t('wizard.personalInfoWiz.addressVerified') || 'Dirección verificada por USPS'}`
                  : uspsStatus === 'invalid'
                  ? `❌ ${t('wizard.personalInfoWiz.addressNotFound') || 'USPS no pudo verificar'}`
                  : uspsStatus === 'validating'
                  ? t('wizard.personalInfoWiz.validating') || 'Verificando...'
                  : `📮 ${t('wizard.personalInfoWiz.validateUSPS') || 'Verificar con USPS'}`}
              </Text>
            </TouchableOpacity>
          )}
          {uspsStatus === 'valid' && uspsAddress ? (
            <View style={styles.uspsResult}>
              <Text style={styles.uspsResultText}>📍 {uspsAddress}</Text>
            </View>
          ) : null}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomCTA}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>{t('wizard.continue')}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#065F46',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerStep: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputHalf: {
    flex: 1,
  },
  inputQuarter: {
    flex: 0.5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bottomCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  tinStatusIcon: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  tinMessageBox: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tinMessageText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tinVerifyingText: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 4,
    fontStyle: 'italic',
  },
  uspsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a365d',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  uspsButtonValid: {
    backgroundColor: '#276749',
  },
  uspsButtonInvalid: {
    backgroundColor: '#c53030',
  },
  uspsButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  uspsResult: {
    backgroundColor: '#f0fff4',
    borderWidth: 1,
    borderColor: '#c6f6d5',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  uspsResultText: {
    fontSize: 13,
    color: '#276749',
    fontWeight: '500',
  },
});
