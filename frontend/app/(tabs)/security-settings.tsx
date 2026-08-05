import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrustedDevice {
  id: string;
  device_name: string;
  created_at: string;
  last_used: string;
  expires_at: string;
}

export default function SecuritySettings() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  // 2FA State
  const [loading, setLoading] = useState(true);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [phoneLast4, setPhoneLast4] = useState('');
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);

  // Setup flow
  const [showSetup, setShowSetup] = useState(false);
  const [setupPhone, setSetupPhone] = useState('');
  const [setupStep, setSetupStep] = useState<'phone' | 'verify'>('phone');
  const [setupCode, setSetupCode] = useState(['', '', '', '', '', '']);
  const [setupLoading, setSetupLoading] = useState(false);
  const setupCodeRefs = useRef<(TextInput | null)[]>([]);

  // Disable flow
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // Animations
  const shieldScale = useRef(new Animated.Value(0.5)).current;
  const shieldOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    load2FAStatus();
    // Entrance animations
    Animated.parallel([
      Animated.spring(shieldScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(shieldOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const load2FAStatus = async () => {
    try {
      const [statusRes, devicesRes] = await Promise.all([
        api.get('/auth/2fa/status'),
        api.get('/auth/2fa/trusted-devices'),
      ]);
      setTwoFAEnabled(statusRes.data?.enabled || false);
      setPhoneLast4(statusRes.data?.phone_last_4 || '');
      setTrustedDevices(devicesRes.data?.devices || []);
    } catch (error) {
      console.error('Error loading 2FA status:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========= SETUP 2FA =========
  const handleStartSetup = () => {
    setShowSetup(true);
    setSetupStep('phone');
    setSetupPhone(user?.phone || '');
  };

  const handleSendSetupCode = async () => {
    if (!setupPhone || setupPhone.length < 10) {
      Alert.alert('Error', 'Ingresa un numero de telefono valido');
      return;
    }
    setSetupLoading(true);
    try {
      await api.post('/auth/2fa/setup', { phone: setupPhone });
      setSetupStep('verify');
      setTimeout(() => setupCodeRefs.current[0]?.focus(), 400);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Error al enviar codigo');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSetupCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...setupCode];
    newCode[index] = value.slice(-1);
    setSetupCode(newCode);
    if (value && index < 5) setupCodeRefs.current[index + 1]?.focus();
    if (value && index === 5 && newCode.every(c => c !== '')) handleVerifySetup(newCode.join(''));
  };

  const handleSetupCodeKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !setupCode[index] && index > 0) {
      setupCodeRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifySetup = async (codeStr?: string) => {
    const code = codeStr || setupCode.join('');
    if (code.length !== 6) return;
    setSetupLoading(true);
    try {
      await api.post('/auth/2fa/verify-setup', { code });
      Alert.alert('Listo', '2FA activado correctamente');
      setShowSetup(false);
      setSetupCode(['', '', '', '', '', '']);
      load2FAStatus();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Codigo incorrecto');
      setSetupCode(['', '', '', '', '', '']);
      setTimeout(() => setupCodeRefs.current[0]?.focus(), 200);
    } finally {
      setSetupLoading(false);
    }
  };

  // ========= DISABLE 2FA =========
  const handleDisable2FA = async () => {
    if (!disablePassword) {
      Alert.alert('Error', 'Ingresa tu contrasena');
      return;
    }
    setDisableLoading(true);
    try {
      await api.post('/auth/2fa/disable', { password: disablePassword });
      Alert.alert('Desactivado', '2FA ha sido desactivado');
      setShowDisable(false);
      setDisablePassword('');
      load2FAStatus();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Contrasena incorrecta');
    } finally {
      setDisableLoading(false);
    }
  };

  // ========= TRUSTED DEVICES =========
  const handleRemoveDevice = (deviceId: string, deviceName: string) => {
    Alert.alert('Eliminar dispositivo', `Eliminar "${deviceName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/2fa/trusted-devices/${deviceId}`);
            setTrustedDevices(prev => prev.filter(d => d.id !== deviceId));
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.detail || 'Error');
          }
        },
      },
    ]);
  };

  const handleRemoveAllDevices = () => {
    Alert.alert('Eliminar todos', 'Tendras que verificar con codigo en todos tus dispositivos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar todos', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/auth/2fa/trusted-devices');
            setTrustedDevices([]);
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.detail || 'Error');
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  const daysRemaining = (dateStr: string) => {
    try {
      const diff = new Date(dateStr).getTime() - Date.now();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch { return 0; }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b', '#0f172a']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={24} color="#e2e8f0" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Seguridad</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* ===== HERO STATUS ===== */}
            <Animated.View style={[styles.heroCard, { opacity: shieldOpacity, transform: [{ scale: shieldScale }] }]}>
              <LinearGradient
                colors={twoFAEnabled ? ['#059669', '#10b981', '#34d399'] : ['#475569', '#64748b', '#94a3b8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGradient}
              >
                {/* Decorative circles */}
                <View style={[styles.decorCircle, { top: -20, right: -20, width: 100, height: 100, opacity: 0.1 }]} />
                <View style={[styles.decorCircle, { bottom: -10, left: -10, width: 60, height: 60, opacity: 0.08 }]} />

                <View style={styles.heroShieldWrap}>
                  <View style={[styles.heroShieldCircle, { backgroundColor: twoFAEnabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }]}>
                    <Ionicons
                      name={twoFAEnabled ? 'shield-checkmark' : 'shield-outline'}
                      size={36}
                      color="#fff"
                    />
                  </View>
                </View>

                <Text style={styles.heroTitle}>
                  {twoFAEnabled ? 'Proteccion Activa' : 'Sin Proteccion Extra'}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {twoFAEnabled
                    ? `Codigo SMS al ****${phoneLast4} en cada inicio de sesion`
                    : 'Activa 2FA para proteger tu cuenta con verificacion SMS'}
                </Text>

                {!twoFAEnabled ? (
                  <TouchableOpacity style={styles.heroPrimaryBtn} onPress={handleStartSetup} activeOpacity={0.8}>
                    <Ionicons name="shield-checkmark" size={18} color="#059669" />
                    <Text style={styles.heroPrimaryBtnText}>Activar Verificacion</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.heroStatusPill}>
                    <View style={styles.heroDot} />
                    <Text style={styles.heroStatusText}>2FA Activo</Text>
                  </View>
                )}
              </LinearGradient>
            </Animated.View>

            {/* ===== SETUP FLOW ===== */}
            {showSetup && (
              <Animated.View style={[styles.sectionCard, { opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: '#ecfdf5' }]}>
                    <Ionicons name="phone-portrait" size={20} color="#059669" />
                  </View>
                  <Text style={styles.sectionTitle}>
                    {setupStep === 'phone' ? 'Configurar 2FA' : 'Verificar Codigo'}
                  </Text>
                </View>

                {setupStep === 'phone' ? (
                  <>
                    <Text style={styles.sectionDesc}>Ingresa el numero donde recibiras los codigos SMS.</Text>
                    <View style={styles.modernInput}>
                      <Ionicons name="call-outline" size={18} color="#94a3b8" />
                      <TextInput
                        style={styles.modernInputText}
                        value={setupPhone}
                        onChangeText={setSetupPhone}
                        placeholder="+1 (806) 930-7456"
                        placeholderTextColor="#64748b"
                        keyboardType="phone-pad"
                        autoFocus
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.actionBtn, setupLoading && { opacity: 0.5 }]}
                      onPress={handleSendSetupCode}
                      disabled={setupLoading}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={['#059669', '#10b981']} style={styles.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Ionicons name="send" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>{setupLoading ? 'Enviando...' : 'Enviar Codigo'}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowSetup(false)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.sectionDesc}>Ingresa el codigo de 6 digitos enviado a {setupPhone}</Text>
                    <View style={styles.otpRow}>
                      {setupCode.map((digit, i) => (
                        <TextInput
                          key={i}
                          ref={(el) => { setupCodeRefs.current[i] = el; }}
                          style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                          value={digit}
                          onChangeText={(val) => handleSetupCodeChange(i, val)}
                          onKeyPress={({ nativeEvent }) => handleSetupCodeKeyPress(i, nativeEvent.key)}
                          keyboardType="number-pad"
                          maxLength={1}
                          selectTextOnFocus
                        />
                      ))}
                    </View>
                    <TouchableOpacity
                      style={[styles.actionBtn, (setupLoading || setupCode.some(c => !c)) && { opacity: 0.5 }]}
                      onPress={() => handleVerifySetup()}
                      disabled={setupLoading || setupCode.some(c => !c)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={['#059669', '#10b981']} style={styles.actionBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>{setupLoading ? 'Verificando...' : 'Verificar y Activar'}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setSetupStep('phone'); setSetupCode(['','','','','','']); }} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>Cambiar numero</Text>
                    </TouchableOpacity>
                  </>
                )}
              </Animated.View>
            )}

            {/* ===== DISABLE FLOW ===== */}
            {showDisable && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: '#fef2f2' }]}>
                    <Ionicons name="warning" size={20} color="#ef4444" />
                  </View>
                  <Text style={styles.sectionTitle}>Desactivar 2FA</Text>
                </View>
                <Text style={styles.sectionDesc}>Confirma con tu contrasena para desactivar la verificacion.</Text>
                <View style={styles.modernInput}>
                  <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                  <TextInput
                    style={styles.modernInputText}
                    value={disablePassword}
                    onChangeText={setDisablePassword}
                    placeholder="Tu contrasena"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    autoFocus
                  />
                </View>
                <TouchableOpacity
                  style={[styles.dangerBtn, disableLoading && { opacity: 0.5 }]}
                  onPress={handleDisable2FA}
                  disabled={disableLoading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shield-outline" size={16} color="#fff" />
                  <Text style={styles.dangerBtnText}>{disableLoading ? 'Procesando...' : 'Desactivar 2FA'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowDisable(false); setDisablePassword(''); }} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ===== TRUSTED DEVICES ===== */}
            {twoFAEnabled && (
              <Animated.View style={[styles.sectionCard, { opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons name="phone-portrait" size={20} color="#3b82f6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Dispositivos de Confianza</Text>
                  </View>
                  {trustedDevices.length > 0 && (
                    <TouchableOpacity onPress={handleRemoveAllDevices} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.removeAllLink}>Limpiar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.sectionDesc}>Inician sesion sin codigo 2FA por 30 dias.</Text>

                {trustedDevices.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyIconCircle}>
                      <Ionicons name="phone-portrait-outline" size={28} color="#64748b" />
                    </View>
                    <Text style={styles.emptyTitle}>Sin dispositivos</Text>
                    <Text style={styles.emptySubtitle}>Al marcar "Recordar dispositivo" en el login, aparecera aqui.</Text>
                  </View>
                ) : (
                  <View style={styles.devicesList}>
                    {trustedDevices.map((device, idx) => {
                      const days = daysRemaining(device.expires_at);
                      const isIOS = device.device_name?.toLowerCase().includes('iphone') || device.device_name?.toLowerCase().includes('ios');
                      return (
                        <View key={device.id} style={[styles.deviceItem, idx < trustedDevices.length - 1 && styles.deviceBorder]}>
                          <View style={[styles.deviceIconCircle, { backgroundColor: isIOS ? '#f0f9ff' : '#f0fdf4' }]}>
                            <Ionicons name={isIOS ? 'logo-apple' : 'logo-android'} size={22} color={isIOS ? '#0ea5e9' : '#22c55e'} />
                          </View>
                          <View style={styles.deviceInfo}>
                            <Text style={styles.deviceName} numberOfLines={1}>{device.device_name}</Text>
                            <Text style={styles.deviceMeta}>
                              {days > 0 ? `Expira en ${days} dias` : 'Expirado'} · {formatDate(device.created_at)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveDevice(device.id, device.device_name)}
                            style={styles.removeDeviceBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close-circle" size={22} color="#94a3b8" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Animated.View>
            )}

            {/* ===== QUICK ACTIONS ===== */}
            <Animated.View style={[{ opacity: cardOpacity, transform: [{ translateY: cardSlide }] }]}>
              {/* Disable 2FA button if enabled and not in disable flow */}
              {twoFAEnabled && !showDisable && (
                <TouchableOpacity style={styles.quickAction} onPress={() => setShowDisable(true)} activeOpacity={0.7}>
                  <View style={[styles.quickActionIcon, { backgroundColor: '#fef2f2' }]}>
                    <Ionicons name="shield-outline" size={22} color="#ef4444" />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionTitle}>Desactivar 2FA</Text>
                    <Text style={styles.quickActionSub}>Eliminar proteccion extra</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#475569" />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/change-password')} activeOpacity={0.7}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="key" size={22} color="#d97706" />
                </View>
                <View style={styles.quickActionContent}>
                  <Text style={styles.quickActionTitle}>Cambiar Contrasena</Text>
                  <Text style={styles.quickActionSub}>Actualiza tu contrasena</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#475569" />
              </TouchableOpacity>
            </Animated.View>

            {/* ===== INFO TIP ===== */}
            <View style={styles.tipCard}>
              <Ionicons name="bulb-outline" size={18} color="#fbbf24" />
              <Text style={styles.tipText}>
                La verificacion en dos pasos envia un codigo SMS cada vez que inicias sesion, protegiendote contra accesos no autorizados.
              </Text>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9', letterSpacing: 0.3 },
  scrollContent: { paddingHorizontal: 16 },

  // Hero Status
  heroCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  heroGradient: { padding: 28, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  decorCircle: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
  heroShieldWrap: { marginBottom: 16 },
  heroShieldCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6, letterSpacing: 0.3 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 19, maxWidth: 280 },
  heroPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13, marginTop: 20, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  heroPrimaryBtnText: { fontSize: 15, fontWeight: '700', color: '#059669' },
  heroStatusPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16, gap: 8,
  },
  heroDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  heroStatusText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Section Cards
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  sectionDesc: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 16 },

  // Modern Input
  modernInput: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
    borderRadius: 14, paddingHorizontal: 16, height: 52, borderWidth: 1.5, borderColor: '#e2e8f0', marginBottom: 16, gap: 10,
  },
  modernInputText: { flex: 1, fontSize: 16, color: '#1e293b', fontWeight: '500' },

  // OTP
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  otpBox: {
    width: 46, height: 54, borderRadius: 14, borderWidth: 2, borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc', fontSize: 22, fontWeight: '700', textAlign: 'center', color: '#1e293b',
  },
  otpBoxFilled: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },

  // Buttons
  actionBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  actionBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ef4444', borderRadius: 14, paddingVertical: 14, marginBottom: 8, gap: 8,
  },
  dangerBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, color: '#64748b', fontWeight: '600' },

  // Devices
  removeAllLink: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#475569', marginBottom: 4 },
  emptySubtitle: { fontSize: 12, color: '#94a3b8', textAlign: 'center', maxWidth: 240 },
  devicesList: { marginTop: 4 },
  deviceItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  deviceBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  deviceIconCircle: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  deviceInfo: { flex: 1, marginLeft: 12 },
  deviceName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  deviceMeta: { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  removeDeviceBtn: { padding: 6 },

  // Quick Actions
  quickAction: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  quickActionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  quickActionContent: { flex: 1, marginLeft: 14 },
  quickActionTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  quickActionSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // Tip
  tipCard: {
    flexDirection: 'row', backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 14, padding: 14, gap: 10, alignItems: 'flex-start', marginTop: 6,
    borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.15)',
  },
  tipText: { flex: 1, fontSize: 12, color: '#cbd5e1', lineHeight: 18 },
});
