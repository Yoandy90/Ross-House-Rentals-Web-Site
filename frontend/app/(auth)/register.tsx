import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, UserRole } from '../../src/contexts/AuthContext';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../../src/constants/theme';

type RoleOption = {
  key: UserRole;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  glowColor: string;
};

const ROLES: RoleOption[] = [
  { key: 'guest', icon: 'eye-outline', color: '#8B5CF6', glowColor: 'rgba(139,92,246,0.15)' },
  { key: 'landlord', icon: 'business-outline', color: '#3B82F6', glowColor: 'rgba(59,130,246,0.15)' },
  { key: 'buyer', icon: 'cart-outline', color: '#10B981', glowColor: 'rgba(16,185,129,0.15)' },
];

export default function RegisterScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const { t } = useTranslation();
  const { register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [role, setRole] = useState<UserRole>('guest');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const webInput = Platform.OS === 'web' ? { outline: 'none', borderWidth: 0 } as any : {};

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Alert.alert('Error', 'Todos los campos son requeridos');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Error', t('forgot.password_min'));
      return;
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: password,
        role,
        company_name: role === 'landlord' ? companyName.trim() : undefined,
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const activeRole = ROLES.find(r => r.key === role) || ROLES[0];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Background Glow Effects */}
      <View style={[styles.bgGlow1, { backgroundColor: activeRole.color }]} />
      <View style={[styles.bgGlow2, { backgroundColor: activeRole.color }]} />
      <View style={styles.gridLine1} />
      <View style={styles.gridLine2} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <View style={styles.backBtnInner}>
              <Ionicons name="arrow-back" size={22} color={C.textPrimary} />
            </View>
          </TouchableOpacity>

          {/* Premium Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.outerRing}>
              <View style={styles.innerRing}>
                <View style={styles.logoIcon}>
                  <LinearGradient
                    colors={[`${activeRole.color}40`, `${activeRole.color}15`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="person-add" size={32} color={C.textPrimary} />
                </View>
              </View>
            </View>
            <Text style={styles.title}>{t('auth.register')}</Text>
            <Text style={styles.subtitle}>{t('auth.register_subtitle')}</Text>
          </View>

          {/* Role Selection */}
          <Text style={styles.sectionLabel}>{t('auth.select_role')}</Text>
          <View style={styles.rolesRow}>
            {ROLES.map((r) => {
              const isActive = role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    styles.roleCard,
                    isActive && { borderColor: `${r.color}40`, backgroundColor: `${r.color}08` },
                  ]}
                  onPress={() => setRole(r.key)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.roleIconWrap,
                    { backgroundColor: isActive ? r.color : 'rgba(255,255,255,0.05)' },
                  ]}>
                    <Ionicons name={r.icon} size={20} color={isActive ? C.white : C.textMuted} />
                  </View>
                  <Text style={[styles.roleTitle, isActive && { color: r.color }]}>
                    {t(`auth.role_${r.key}`)}
                  </Text>
                  <Text style={styles.roleDesc} numberOfLines={2}>
                    {t(`auth.role_${r.key}_desc`)}
                  </Text>
                  {isActive && (
                    <View style={[styles.roleCheck, { backgroundColor: r.color }]}>
                      <Ionicons name="checkmark" size={12} color={C.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Form Card - Glass Style */}
          <View style={styles.formCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Name Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('auth.name')}</Text>
              <View style={styles.glassField}>
                <Ionicons name="person-outline" size={18} color={C.textMuted} style={{ marginRight: 12 }} />
                <TextInput
                  style={[styles.glassInput, webInput]}
                  value={name}
                  onChangeText={setName}
                  placeholder="John Doe"
                  placeholderTextColor={C.textDim}
                />
              </View>
            </View>

            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
              <View style={styles.glassField}>
                <Ionicons name="mail-outline" size={18} color={C.textMuted} style={{ marginRight: 12 }} />
                <TextInput
                  style={[styles.glassInput, webInput]}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor={C.textDim}
                />
              </View>
            </View>

            {/* Phone Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('auth.phone')}</Text>
              <View style={styles.glassField}>
                <Ionicons name="call-outline" size={18} color={C.textMuted} style={{ marginRight: 12 }} />
                <TextInput
                  style={[styles.glassInput, webInput]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="(806) 555-1234"
                  placeholderTextColor={C.textDim}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
              <View style={styles.glassField}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textMuted} style={{ marginRight: 12 }} />
                <TextInput
                  style={[styles.glassInput, { flex: 1 }, webInput]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder={t('forgot.new_password_placeholder')}
                  placeholderTextColor={C.textDim}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Company Name (landlord only) */}
            {role === 'landlord' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('auth.company_name')}</Text>
                <View style={styles.glassField}>
                  <Ionicons name="business-outline" size={18} color={C.textMuted} style={{ marginRight: 12 }} />
                  <TextInput
                    style={[styles.glassInput, webInput]}
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder="Mi Empresa LLC"
                    placeholderTextColor={C.textDim}
                  />
                </View>
              </View>
            )}

            {/* Commission Note for landlords */}
            {role === 'landlord' && (
              <View style={styles.commissionNote}>
                <Ionicons name="information-circle-outline" size={16} color={C.warmGold} />
                <Text style={styles.commissionText}>{t('landlord.commission_note')}</Text>
              </View>
            )}

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              style={[styles.primaryBtn, loading && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[activeRole.color, `${activeRole.color}CC`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
              />
              {loading ? (
                <View style={styles.btnRow}>
                  <Text style={styles.btnText}>{t('auth.registering')}</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="person-add-outline" size={20} color="#fff" />
                  <Text style={styles.btnText}>{t('auth.register')}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Switch to Login */}
            <TouchableOpacity onPress={() => router.back()} style={styles.switchLink}>
              <Text style={styles.switchText}>{t('auth.has_account')} </Text>
              <Text style={styles.switchAction}>{t('auth.login')}</Text>
            </TouchableOpacity>
          </View>

          {/* Watermark */}
          <Text style={styles.watermark}>Ross House Rentals LLC</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },

  // Background Effects
  bgGlow1: {
    position: 'absolute',
    top: -60,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.06,
  },
  bgGlow2: {
    position: 'absolute',
    bottom: '20%',
    left: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.04,
  },
  gridLine1: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: C.glass,
  },
  gridLine2: {
    position: 'absolute',
    top: '65%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: C.glass,
  },

  // Back Button
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  backBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Premium Logo
  logoContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  outerRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.glassBorderLight,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: '800',
    color: C.textPrimary,
    marginTop: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: C.textMuted,
    marginTop: 4,
  },

  // Section Label
  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: C.textMuted,
    marginBottom: 12,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // Role Cards
  rolesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  roleCard: {
    flex: 1,
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: C.glassBorder,
    alignItems: 'center',
    position: 'relative',
  },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleTitle: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: C.textPrimary,
    textAlign: 'center',
  },
  roleDesc: {
    fontSize: 10,
    color: C.textMuted,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 13,
  },
  roleCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Glass Form Card
  formCard: {
    backgroundColor: C.glass,
    borderRadius: BorderRadius.card,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
    position: 'relative',
  },

  // Field Groups
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: C.textMuted,
    fontSize: FontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  glassField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.glass,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  glassInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: C.textPrimary,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },

  // Commission Note
  commissionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.06)',
    padding: 12,
    borderRadius: BorderRadius.sm,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.12)',
  },
  commissionText: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: C.warmGold,
    lineHeight: 18,
  },

  // Primary Button
  primaryBtn: {
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
    ...Shadows.button,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: C.textPrimary,
  },

  // Switch Link
  switchLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.base,
  },
  switchText: {
    color: C.textMuted,
    fontSize: FontSizes.sm,
  },
  switchAction: {
    color: C.brandRed,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },

  // Watermark
  watermark: {
    textAlign: 'center',
    color: C.textDim,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingVertical: 16,
    opacity: 0.4,
  },
});
